package Plack::Debugger::Panel::AJAX;

use strict;
use warnings;

our $VERSION   = '0.01';
our $AUTHORITY = 'cpan:STEVAN';

use parent 'Plack::Debugger::Panel';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'title'}     ||= 'AJAX Requests';
    $args{'formatter'} ||= 'subrequest_formatter';

    $args{'before'} = sub {
        my ($self, $env) = @_;
        # if it is a subrequest already,
        # then we can just disable it
        $self->disable if $self->is_subrequest( $env );
    };

    my $self = $class->SUPER::new( \%args );
    $self->add_metadata( track_subrequests     => 1 );
    $self->add_metadata( highlight_on_warnings => 1 );
    $self->add_metadata( highlight_on_errors   => 1 );
    $self;
}

1;

__END__

=pod

=head1 NAME

Plack::Debugger::Panel::AJAX - Debug panel for inspecting AJAX requests

=head1 DESCRIPTION

=head1 ACKNOWLEDGEMENTS

Thanks to Booking.com for sponsoring the writing of this module.

=cut