package Plack::Debugger::Panel;

# ABSTRACT: Base class for the debugger panels

use strict;
use warnings;

use Try::Tiny;
use Scalar::Util qw[ refaddr ];

our $VERSION   = '0.01';
our $AUTHORITY = 'cpan:STEVAN';

use constant DEBUGGER_PHASES     => [ qw[ before after cleanup  ] ];
use constant NOTIFICATION_LEVELS => [ qw[ error warning success ] ];

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    foreach my $phase ( @{ DEBUGGER_PHASES() } ) {
        if (defined $args{$phase}) {
            die "The '$phase' argument must be a CODE ref, not a " . ref($args{$phase}) . " ref"
                unless ref $args{$phase} 
                    && ref $args{$phase} eq 'CODE'; 
        }
    }

    my $self = bless {
        title    => $args{'title'},
        subtitle => $args{'subtitle'} || '',
        before   => $args{'before'},
        after    => $args{'after'},
        cleanup  => $args{'cleanup'},
        # private data ...
        _result        => undef,
        _stash         => undef,
        _is_enabled    => 1,
        _notifications => { map { $_ => 0 } @{ NOTIFICATION_LEVELS() } },
        _has_phase_run => { map { $_ => 0 } @{ DEBUGGER_PHASES()     } },
        _metadata      => { 
            (exists $args{'formatter'} ? (formatter => $args{'formatter'}) : ()),
            (exists $args{'metadata'}  ? %{$args{'metadata'}} : ()),
        },
    } => $class;

    # ... title if one is not provided
    $self->{'title'} = (split /\:\:/ => $class)[-1] . '<' . refaddr($self) . '>'
        unless defined $self->{'title'};

    $self;
}

# accessors 

sub title    { (shift)->{'title'}    } # the main title to display for this debug panel (optional, but recommended)
sub subtitle { (shift)->{'subtitle'} } # the sub-title to display for this debug panel (optional)    

sub set_subtitle {
    my $self     = shift;
    my $subtitle = shift // die "Must supply a value for subtitle";
    $self->{'subtitle'} = $subtitle;
}

# phase runners 

sub run_before_phase {
    my ($self, $env) = @_;
    try {
        $self->before->( $self, $env ) if $self->has_before;
        $self->mark_phase_as_run('before');
    } catch {
        warn 'Got an exception in during the `begin` phase of `' . $self->title . '` Plack::Debugger panel: ' . $_;
    };
}

sub run_after_phase {
    my ($self, $env, $resp) = @_;
    # Do NOT run the after if the corresponding before has not run ...
    return unless $self->have_phases_run('before');
    try {
        $self->after->( $self, $env, $resp ) if $self->has_after;
        $self->mark_phase_as_run('after');
    } catch {
        warn 'Got an exception in during the `after` phase of `' . $self->title . '` Plack::Debugger panel: ' . $_;
    };
}

sub run_cleanup_phase {
    my ($self, $env) = @_;
    # Do NOT run the cleanup if the corresponding before & after have not run ...
    return unless $self->have_phases_run('before', 'after');
    try {
        $self->cleanup->( $self, $env ) if $self->has_cleanup;
        $self->mark_phase_as_run('cleanup');
    } catch {
        warn 'Got an exception in during the `cleanup` phase of `' . $self->title . '` Plack::Debugger panel: ' . $_;
    };
}

# phase runner tracking

sub have_phases_run {
    my ($self, @phases) = @_;
    die 'You need to pass `@phases` argument' if scalar @phases == 0;
    (scalar @phases) == (scalar grep { $self->{'_has_phase_run'}->{ $_ } } @phases);
}

sub mark_phase_as_run {
    my ($self, $phase) = @_;
    die 'You need to pass a `phase` argument' unless $phase;
    $self->{'_has_phase_run'}->{ $phase } = 1;
}

sub mark_phase_as_not_run {
    my ($self, $phase) = @_;
    die 'You need to pass a `phase` argument' unless $phase;
    $self->{'_has_phase_run'}->{ $phase } = 0;
}

# phase handlers

sub before   { (shift)->{'before'}   } # code ref to be run before the request   - args: ($self, $env)
sub after    { (shift)->{'after'}    } # code ref to be run after the request    - args: ($self, $env, $response)
sub cleanup  { (shift)->{'cleanup'}  } # code ref to be run in the cleanup phase - args: ($self, $env, $response)    

# some useful predicates ...

sub has_before   { !! (shift)->before  }
sub has_after    { !! (shift)->after   }
sub has_cleanup  { !! (shift)->cleanup }

# notification ...

sub has_notifications {
    my $self = shift;
    !! scalar grep { $_ } values %{ $self->{'_notifications'} };
}

sub notifications { (shift)->{'_notifications'} }

sub notify {
    my ($self, $type, $inc) = @_;
    $inc ||= 1;
    die "Notification must be one of the following types (error, warning or info)"
        unless scalar grep { $_ eq $type } @{ NOTIFICATION_LEVELS() };
    $self->{'_notifications'}->{ $type } += $inc;
}

# metadata ...

sub has_metadata {
    my $self = shift;
    !! scalar keys %{ $self->{'_metadata'} };
}

sub metadata { (shift)->{'_metadata'} }

# TODO:
# it might make sense to restrict the 
# metadata keys eventually since they 
# will need to be understood by the 
# JS side and basically, random stuff 
# is bad.
# - SL

sub add_metadata {
    my ($self, $key, $data) = @_;
    $self->{'_metadata'}->{ $key } = $data;
}

# check if we are in a sub-request ...

sub is_subrequest {
    my ($self, $env) = @_;
    exists $env->{'HTTP_X_PLACK_DEBUGGER_PARENT_REQUEST_UID'} 
        || 
    exists $env->{'plack.debugger.parent_request_uid'};
}

# turning it on and off ...

sub is_disabled { (shift)->{'_is_enabled'} == 0 }
sub is_enabled  { (shift)->{'_is_enabled'} == 1 }

sub disable { (shift)->{'_is_enabled'} = 0 }
sub enable  { (shift)->{'_is_enabled'} = 1 }

# stash ...

sub stash {
    my $self = shift;
    $self->{'_stash'} = shift if @_;
    $self->{'_stash'};
}

# final result ...

sub get_result { (shift)->{'_result'} }
sub set_result {
    my $self    = shift;
    my $results = shift || die 'You must provide a results';

    $self->{'_result'} = $results;
}

# reset ...

sub reset {
    my $self = shift;
    foreach my $slot ( qw[ _stash _result ]) {
        if ( my $data = $self->{ $slot } ) {
            if ( ref $data ) {
                if ( ref $data eq 'ARRAY' ) {
                    @$data = ();
                }
                elsif ( ref $data eq 'HASH' ) {
                    %$data = ();
                }
            }
            undef $self->{ $slot };
        }
    }
    $self->{'_is_enabled'} = 1;
    $self->{'_notifications'}->{ $_ } = 0 foreach @{ NOTIFICATION_LEVELS() };
    $self->{'_has_phase_run'}->{ $_ } = 0 foreach @{ DEBUGGER_PHASES()     };
}

1;

__END__

=pod

=head1 DESCRIPTION

This is the base class for all the Plack::Debugger panels, most of the subclasses
of this module will simply pass in a set of custom arguments to the constructor 
and not much more. 

=head1 METHODS

=over 4

=item C<new (%args)>

This will look in C<%args> for a number of values, technically there are no 
required keys, but the code won't do very much if you don't give it anything.

This accepts the C<title> key, which is a string to display on the debugger 
UI, it will default to something generated with C<refaddr>, but it is better 
to specify it.

This accepts the C<subtitle> key, which is also displayed in the debugger UI
and can be used to present additional data to the user, it defaults to an 
empty string.

This accepts the C<before>, C<after> and C<cleanup> callbacks and checks to 
make sure that they are all CODE references.

This accepts the C<formatter> key, this is a string that is passed to 
the debugger UI via the C<metadata> to tell the UI how to render the data
that is stored in the C<result> of the panel.

This accepts the C<metadata> key, this is a HASH reference that is passed to 
the debugging UI. The types of keys accepted are determined by the debugger 
UI and what it handles. See the docs for C<metadata> below for information
on those keys.

=item C<title>

Simple read accessor for the C<title>.

=item C<subtitle>

Simple read accessor for the C<subtitle>.

=item C<set_subtitle ($subtitle)>

Simple write accessor for the C<subtitle>.

=item C<run_before_phase ($env)>

This will run the C<before> callback and mark that phase as having
been run. 

=item C<run_after_phase ($env, $resp)>

This will run the C<after> callback and mark that phase as having
been run. This phase will only run if the C<before> phase has also
been run, since it may have stashed data that is needed by this 
phase.

=item C<run_cleanup_phase ($env)>

This will run the C<cleanup> callback and mark that phase as having
been run. This phase will only run if the C<before> and C<after> 
phases have also been run, since they may have stashed data that 
is needed by this phase.

=item C<mark_phase_as_run ($phase)>

Marks a phase as having been run.

=item C<mark_phase_as_not_run ($phase)>

Marks a phase as having B<not> been run.

=item C<have_phases_run (@phases)>

This predicate will return true if all the C<@phases> specified have
been marked as run.

=item C<before>

Simple read accessor for the C<before> callback.

=item C<has_before>

Simple predicate to determine if we have a C<before> callback.

=item C<after>

Simple read accessor for the C<after> callback.

=item C<has_after>

Simple predicate to determine if we have an C<after> callback.

=item C<cleanup>

Simple read accessor for the C<cleanup> callback.

=item C<has_cleanup>

Simple predicate to determine if we have a C<cleanup> callback.

=item C<notify ($type, ?$inc)>

This method can be used to mark a panel specific event as having happened 
during the request and the user should be notified about. The C<$type> 
argument must match one of the strings in the C<NOTIFICATION_LEVELS> constant, 
which are basically; success, warning or error. The optional C<$inc> argument 
can be used to mark more then one event of the specified C<$type> as 
having happened. If C<$inc> is not specified then a value of 1 is assumed.

=item C<has_notifications>

Simple predicate to determine if we have any notifications.

=item C<notifications>

Simple read accessor for the notification data.

=item C<add_metadata ($key, $data)>

Sets the metadata C<$key> to C<$data>.

=item C<has_metadata>

Simple predicate to tell if we have any metadata available.

=item C<metadata>

Simple accessor for the metadata that is passed back to the debugger UI
about this particular panel. There is no specific set of acceptable keys
for this, but the UI currently only understands the following:

=over 4

=item C<formatter>

This can be optionally specifed via the C<formatter> constructor parameter, 
see the docs for C<new> for more details on this.

=item C<track_subrequests>  

This is used to tell the debugging UI that it should start tracking AJAX 
requests.

=item C<highlight_on_warnings>

This is used to tell the debugging UI that it should highlight the UI elements
associated with this panel when there are any C<warning> notifications.

=item C<highlight_on_errors>

This is used to tell the debugging UI that it should highlight the UI elements
associated with this panel when there are any C<error> notifications.

=back

=item C<is_subrequest ($env)>

This looks at the PSGI C<$env> to determine if the current request 
is actually a sub-request. This is primarily used in panels to disable
themselves in a subrequest if it is not appropriate for it to run.

=item C<disable>

This sets a flag to disable the panel for this particular request.

=item C<is_disabled>

Simple predicate to determine if the panel is disabled or not.

=item C<enable>

This sets a flag to enable the panel for this particular request.

=item C<is_enabled>

Simple predicate to determine if the panel is enabled or not.

=item C<stash (?$data)>

This is just a simple read/write accessor for a general purpose 
C<stash> that can be used to pass data in between the various 
phases of the panel.

=item C<get_result>

This is a read accessor for the final result data for the panel.

=item C<set_result ($result)>

This is a write accessor for the final result data for the panel.

=item C<reset>

This method will be called at the end of a request to reset all the 
panel data so it can be ready for the next run. It will aggressively 
delete the C<stash> and C<result> data to avoid the possibility of 
leaking memory, after that it will result some internal book keeping
data (enabled flag, notifications and list of phases that have been 
run).

=back

=head1 ACKNOWLEDGMENT

This module was originally developed for Booking.com. With approval 
from Booking.com, this module was generalized and published on CPAN, 
for which the author would like to express their gratitude.

=cut



