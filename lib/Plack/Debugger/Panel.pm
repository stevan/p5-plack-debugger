package Plack::Debugger::Panel;

use strict;
use warnings;

use Scalar::Util qw[ refaddr ];

use constant NOTIFICATION_LEVELS => [ qw[ error warning success ] ];

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    foreach my $phase (qw( before after cleanup )) {
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
        _metadata      => { 
            (exists $args{'formatter'} 
                ? (formatter => $args{'formatter'}) 
                : ()) 
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
}

1;

__END__

=pod

=head1 NAME

Plack::Debugger::Panel - Base class for the debugger panels

=head1 DESCRIPTION

=head1 ACKNOWLEDGEMENTS

Thanks to Booking.com for sponsoring the writing of this module.

=cut



