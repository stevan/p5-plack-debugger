package Plack::Middleware::Debugger::Collector;

# ABSTRACT: Middleware for collecting debugging data

use strict;
use warnings;

our $VERSION   = '0.01';
our $AUTHORITY = 'cpan:STEVAN';

use Scalar::Util qw[ blessed weaken ];

use parent 'Plack::Middleware';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    die "You must pass a reference to a 'Plack::Debugger' instance"
        unless blessed $args{'debugger'} 
            && $args{'debugger'}->isa('Plack::Debugger');

    $class->SUPER::new( %args );
}

# accessors ...

sub debugger { (shift)->{'debugger'} } # a reference to the Plack::Debugger

# ...

sub call {
    my ($self, $env) = @_;

    # NOTE:
    # we needed to weaken the $env 
    # reference here since we are 
    # stuffing it into at least two 
    # closures here and it was leaking,
    # so be careful with this.
    weaken( $env );

    $self->setup_before_phase( $env );
    $self->setup_cleanup_phase( $env );

    $self->response_cb(
        $self->app->( $env ), 
        $self->setup_after_phase( $env )
    );
}

# init/finalize

sub initialize_request { (shift)->debugger->initialize_request( @_ ) }
sub finalize_request   { (shift)->debugger->finalize_request( @_ )   }

# before ...

sub setup_before_phase {
    my ($self, $env) = @_;
    $self->initialize_request( $env );
    $self->run_before_phase( $env );
}

sub run_before_phase { (shift)->debugger->run_before_phase( @_ ) }

# after ...

sub setup_after_phase {
    my ($self, $env) = @_;
    return sub { 
        my $resp = shift;
        $self->run_after_phase( $env, $resp );
    };
}

sub run_after_phase { 
    my ($self, $env, $resp) = @_;
    $self->debugger->run_after_phase( $env, $resp );
    # if cleanup is not supported 
    # then it is best to finalize
    # at this point
    $self->finalize_request( $env )
        unless $env->{'psgix.cleanup'};
}

# cleanup ...

sub setup_cleanup_phase {
    my ($self, $env) = @_;
    # if we have cleanup capabilities
    # then we should register that phase
    # and a callback to finalize the 
    # request as well
    push @{ $env->{'psgix.cleanup.handlers'} } => (
        sub { $self->run_cleanup_phase( $env ) },
    ) if $env->{'psgix.cleanup'};
}

sub run_cleanup_phase {
    my ($self, $env) = @_;
    $self->debugger->run_cleanup_phase( $env );
    $self->finalize_request( $env );
}

1;

__END__

=pod

=head1 DESCRIPTION

This middleware orchestrates the interaction between the L<Plack::Debugger>
instance and the current request. It sets up the debugger to record the request, 
fires the C<begin> phase and then calls the L<PSGI> application it wraps. It then 
goes about calling the C<after> phase using the C<response_cb> callback. If the
current request supports the C<psgix.cleanup> extension it will setup things so 
that the C<cleanup> phase of the debugger can be run followed by the finalization
of the debugger session. If C<psgix.cleanup> is not supported it will call the 
finalization code immediately after the C<after> phase.

=head1 METHODS

=over 4

=item C<new (%args)>

This expects a C<debugger> key which contains an instance of the L<Plack::Debugger>.

=item C<debugger>

This is just an accessor for the C<debugger> specified in the contstructor.

=item C<call ($env)>

This is just the overriden C<call> method from L<Plack::Middleware>.

=item C<initialize_request ($env)>

This just delegates to the L<Plack::Debugger> method of the same name.

=item C<finalize_request ($env)>

This just delegates to the L<Plack::Debugger> method of the same name.

=item C<setup_before_phase ($env)>

This just sets up the C<before> phase, which basically just calls the 
C<initialize_request> method, followed by the C<run_before_phase> method.

=item C<run_before_phase ($env)>

This just delegates to the L<Plack::Debugger> method of the same name.

=item C<setup_after_phase ($env, $resp)>

This just sets up the C<after> phase, which basically just returns a 
callback suitable for passing into C<response_cb>. The callback then just  
calls the C<run_after_phase> method.

=item C<run_after_phase ($env, $resp)>

This just delegates to the L<Plack::Debugger> method of the same name,
and then calls C<finalize_request> if there is no support for the 
C<psgi.cleanup> extension.

=item C<setup_cleanup_phase ($env)>

This just sets up the C<cleanup> phase, which basically just pushes a
callback in the C<psgi.cleanup.handlers> array, that will call the 
C<run_cleanup_phase> method. Of course it only does this if we have 
support for the C<psgi.cleanup> extension.

=item C<run_cleanup_phase ($env)>

This just delegates to the L<Plack::Debugger> method of the same name,
and then calls C<finalize_request>.

=back

=head1 ACKNOWLEDGMENT

This module was originally developed for Booking.com. With approval 
from Booking.com, this module was generalized and published on CPAN, 
for which the authors would like to express their gratitude.

=cut




