package Plack::Debugger::Panel::Parameters;

use strict;
use warnings;

use Plack::Request;

our $VERSION   = '0.01';
our $AUTHORITY = 'cpan:STEVAN';

use parent 'Plack::Debugger::Panel';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'title'}     ||= 'Request Parameters';
    $args{'formatter'} ||= 'ordered_keys_with_nested_data';

    $args{'after'} = sub {
        my $self = shift;
        my $r    = Plack::Request->new( shift );
        $self->set_result([
            'Query String' => $r->query_parameters->as_hashref_mixed,
            'Cookies'      => $r->cookies,
            'Headers'      => { map { $_ => $r->headers->header( $_ ) } $r->headers->header_field_names },
            'Body Content' => $r->body_parameters->as_hashref_mixed,
            ($r->env->{'psgix.session'} 
                ? ('Session' => $r->env->{'psgix.session'})
                : ()),
        ]);
    };

    $class->SUPER::new( \%args );
}


1;

__END__

=pod

=head1 NAME

Plack::Debugger::Panel::Parameters - Debug panel for inspecting HTTP request parameters

=head1 DESCRIPTION

=head1 ACKNOWLEDGEMENTS

Thanks to Booking.com for sponsoring the writing of this module.

=cut